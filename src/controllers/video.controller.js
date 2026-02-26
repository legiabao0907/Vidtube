import mongoose, { isValidObjectId } from "mongoose"
import { Video } from "../models/video.model.js"
import { User } from "../models/user.model.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { uploadOnCloudinary, deleteFromCloudinary } from "../utils/cloudinary.js"


// ─────────────────────────────────────────────────────────────────────────────
// Helper: lấy Cloudinary public_id từ URL
// VD: "https://res.cloudinary.com/demo/video/upload/v123/myfolder/myvideo.mp4"
//      → "myfolder/myvideo"
// ─────────────────────────────────────────────────────────────────────────────
const extractPublicId = (url) => {
    if (!url) return null
    try {
        const parts = url.split("/")
        // Tìm index của "upload" rồi lấy phần sau (bỏ version nếu có)
        const uploadIndex = parts.indexOf("upload")
        let pathParts = parts.slice(uploadIndex + 1)
        // Bỏ phần version (vXXXX)
        if (/^v\d+$/.test(pathParts[0])) {
            pathParts = pathParts.slice(1)
        }
        // Bỏ phần extension
        const lastPart = pathParts[pathParts.length - 1]
        pathParts[pathParts.length - 1] = lastPart.replace(/\.[^/.]+$/, "")
        return pathParts.join("/")
    } catch {
        return null
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// GET /videos  — lấy danh sách video với tìm kiếm, lọc, sắp xếp, phân trang
// Query params: page, limit, query, sortBy, sortType, userId
// ─────────────────────────────────────────────────────────────────────────────
const getAllVideos = asyncHandler(async (req, res) => {
    const {
        page = 1,
        limit = 10,
        query,
        sortBy = "createdAt",
        sortType = "desc",
        userId,
    } = req.query

    const pipeline = []

    // 1. Lọc theo userId nếu có
    if (userId) {
        if (!isValidObjectId(userId)) {
            throw new ApiError(400, "Invalid userId")
        }
        pipeline.push({
            $match: { owner: new mongoose.Types.ObjectId(userId) }
        })
    }

    // 2. Chỉ lấy video đã published (trừ khi xem của chính mình)
    const currentUserId = req.user?._id?.toString()
    const isOwnChannel = userId && userId === currentUserId
    if (!isOwnChannel) {
        pipeline.push({ $match: { isPublished: true } })
    }

    // 3. Tìm kiếm full-text trên title và description
    if (query && query.trim() !== "") {
        pipeline.push({
            $match: {
                $or: [
                    { title: { $regex: query, $options: "i" } },
                    { description: { $regex: query, $options: "i" } },
                ],
            },
        })
    }

    // 4. Lookup thông tin owner
    pipeline.push(
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "ownerDetails",
                pipeline: [
                    { $project: { username: 1, fullName: 1, avatar: 1 } }
                ]
            }
        },
        { $addFields: { owner: { $arrayElemAt: ["$ownerDetails", 0] } } },
        { $project: { ownerDetails: 0 } }
    )

    // 5. Sắp xếp
    const sortOrder = sortType === "asc" ? 1 : -1
    const allowedSortFields = ["createdAt", "views", "duration", "title"]
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : "createdAt"
    pipeline.push({ $sort: { [safeSortBy]: sortOrder } })

    // 6. Phân trang với aggregatePaginate
    const options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        customLabels: {
            totalDocs: "totalVideos",
            docs: "videos",
        },
    }

    const result = await Video.aggregatePaginate(
        Video.aggregate(pipeline),
        options
    )

    return res.status(200).json(
        new ApiResponse(200, result, "Videos fetched successfully")
    )
})


// ─────────────────────────────────────────────────────────────────────────────
// POST /videos  — đăng video mới
// ─────────────────────────────────────────────────────────────────────────────
const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description } = req.body
    const userId = req.user?._id

    if (!title?.trim() || !description?.trim()) {
        throw new ApiError(400, "Title and description are required")
    }
    if (!req.files?.videoFile?.[0]) {
        throw new ApiError(400, "Video file is required")
    }
    if (!req.files?.thumbnail?.[0]) {
        throw new ApiError(400, "Thumbnail is required")
    }

    const user = await User.findById(userId)
    if (!user) {
        throw new ApiError(404, "User not found")
    }

    // Upload video lên Cloudinary
    const videoLocalPath = req.files.videoFile[0].path
    const videoResult = await uploadOnCloudinary(videoLocalPath)
    if (!videoResult) {
        throw new ApiError(500, "Failed to upload video to Cloudinary")
    }

    // Upload thumbnail lên Cloudinary
    const thumbnailLocalPath = req.files.thumbnail[0].path
    const thumbnailResult = await uploadOnCloudinary(thumbnailLocalPath)
    if (!thumbnailResult) {
        // Dọn video vừa upload nếu thumbnail thất bại
        await deleteFromCloudinary(videoResult.public_id, "video")
        throw new ApiError(500, "Failed to upload thumbnail to Cloudinary")
    }

    // Lấy duration: Cloudinary trả về số giây (float), đảm bảo là số hợp lệ
    const duration = typeof videoResult.duration === "number" && !isNaN(videoResult.duration)
        ? Math.round(videoResult.duration)
        : 0

    const video = await Video.create({
        title: title.trim(),
        description: description.trim(),
        videoFile: videoResult.secure_url,
        thumbnail: thumbnailResult.secure_url,
        duration,
        owner: userId,
    })

    return res
        .status(201)
        .json(new ApiResponse(201, video, "Video published successfully"))
})


// ─────────────────────────────────────────────────────────────────────────────
// GET /videos/:videoId  — lấy thông tin video theo id (tăng lượt xem)
// ─────────────────────────────────────────────────────────────────────────────
const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID")
    }

    // Tăng views và populate owner cùng lúc
    const video = await Video.findByIdAndUpdate(
        videoId,
        { $inc: { views: 1 } },
        { new: true }
    ).populate("owner", "username fullName avatar")

    if (!video) {
        throw new ApiError(404, "Video not found")
    }

    // Nếu video chưa publish, chỉ owner mới được xem
    if (!video.isPublished && video.owner._id.toString() !== req.user?._id?.toString()) {
        throw new ApiError(403, "This video is not published")
    }

    return res
        .status(200)
        .json(new ApiResponse(200, video, "Video fetched successfully"))
})


// ─────────────────────────────────────────────────────────────────────────────
// PATCH /videos/:videoId  — cập nhật title, description, thumbnail
// ─────────────────────────────────────────────────────────────────────────────
const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    const { title, description } = req.body

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID")
    }

    const video = await Video.findById(videoId)
    if (!video) {
        throw new ApiError(404, "Video not found")
    }

    // Kiểm tra quyền sở hữu
    if (video.owner.toString() !== req.user?._id?.toString()) {
        throw new ApiError(403, "You are not authorized to update this video")
    }

    // Cập nhật các trường text nếu được cung cấp
    if (title?.trim()) video.title = title.trim()
    if (description?.trim()) video.description = description.trim()

    // Cập nhật thumbnail nếu có file mới
    if (req.file?.path) {
        // Xóa thumbnail cũ trên Cloudinary
        const oldThumbnailPublicId = extractPublicId(video.thumbnail)
        if (oldThumbnailPublicId) {
            await deleteFromCloudinary(oldThumbnailPublicId, "image")
        }

        // Upload thumbnail mới
        const newThumbnailResult = await uploadOnCloudinary(req.file.path)
        if (!newThumbnailResult) {
            throw new ApiError(500, "Failed to upload new thumbnail to Cloudinary")
        }
        video.thumbnail = newThumbnailResult.secure_url
    }

    await video.save()

    return res
        .status(200)
        .json(new ApiResponse(200, video, "Video updated successfully"))
})


// ─────────────────────────────────────────────────────────────────────────────
// DELETE /videos/:videoId  — xóa video (kèm xóa file trên Cloudinary)
// ─────────────────────────────────────────────────────────────────────────────
const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    console.log("=== DELETE VIDEO ===")
    console.log("videoId from params:", videoId)
    console.log("req.user._id:", req.user?._id)

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID")
    }

    const video = await Video.findById(videoId)
    console.log("video found:", video ? "YES" : "NO")

    if (!video) {
        throw new ApiError(404, "Video not found")
    }

    console.log("video.owner:", video.owner.toString())
    console.log("req.user._id:", req.user?._id?.toString())
    console.log("owner match:", video.owner.toString() === req.user?._id?.toString())

    // Kiểm tra quyền sở hữu
    if (video.owner.toString() !== req.user?._id?.toString()) {
        throw new ApiError(403, "You are not authorized to delete this video")
    }

    // Xóa video trên Cloudinary
    const videoPublicId = extractPublicId(video.videoFile)
    console.log("videoPublicId:", videoPublicId)
    if (videoPublicId) {
        const cloudResult = await deleteFromCloudinary(videoPublicId, "video")
        console.log("Cloudinary video delete result:", cloudResult)
    }

    // Xóa thumbnail trên Cloudinary
    const thumbnailPublicId = extractPublicId(video.thumbnail)
    console.log("thumbnailPublicId:", thumbnailPublicId)
    if (thumbnailPublicId) {
        const cloudResult = await deleteFromCloudinary(thumbnailPublicId, "image")
        console.log("Cloudinary thumbnail delete result:", cloudResult)
    }

    // Xóa document trong DB
    const deleteResult = await Video.findByIdAndDelete(videoId)
    console.log("MongoDB delete result:", deleteResult ? "DELETED" : "NOT FOUND")

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Video deleted successfully"))
})


// ─────────────────────────────────────────────────────────────────────────────
// PATCH /videos/toggle/publish/:videoId  — bật / tắt trạng thái publish
// ─────────────────────────────────────────────────────────────────────────────
const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID")
    }

    const video = await Video.findById(videoId)
    if (!video) {
        throw new ApiError(404, "Video not found")
    }

    // Kiểm tra quyền sở hữu
    if (video.owner.toString() !== req.user?._id?.toString()) {
        throw new ApiError(403, "You are not authorized to toggle publish status of this video")
    }

    video.isPublished = !video.isPublished
    await video.save()

    return res.status(200).json(
        new ApiResponse(
            200,
            { isPublished: video.isPublished },
            `Video ${video.isPublished ? "published" : "unpublished"} successfully`
        )
    )
})


export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus,
}
