import { model, Schema } from "mongoose";


const playlistSchema = new Schema({
    title: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        default: "",
    },
    videos: [
        {
            type: Schema.Types.ObjectId,
            ref: "Video",
        },
    ],
    owner: {
        type: Schema.Types.ObjectId,
        ref: "User",
    },
    isPublic: {
        type: Boolean,
        default: false,
    }
}, { timestamps: true });

export const Playlist = model("Playlist", playlistSchema);