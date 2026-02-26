import { Router } from 'express';
import {
    addVideoToPlaylist,
    createPlaylist,
    deletePlaylist,
    getPlaylistById,
    getUserPlaylists,
    removeVideoFromPlaylist,
    updatePlaylist,
} from "../controllers/playlist.controller.js"
import { verifyJWT } from "../middlewares/auth.middleware.js"

const router = Router();

router.use(verifyJWT); 

router.route("/").post(createPlaylist)


router.route("/user/:userId").get(getUserPlaylists);

router.route("/:playlistId/videos/:videoId")
    .patch(addVideoToPlaylist)
    .delete(removeVideoFromPlaylist);

router
    .route("/:playlistId")
    .get(getPlaylistById)
    .patch(updatePlaylist)
    .delete(deletePlaylist);

export default router