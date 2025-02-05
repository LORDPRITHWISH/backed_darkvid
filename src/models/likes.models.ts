import { model, Schema } from "mongoose";

const likeSchemea = new Schema(
  {
    mood: {
        type:Boolean,
        required:true,
    },
    videoId: {
      type: Schema.Types.ObjectId,
      ref: "Video",
    },
    commentId: {
      type: Schema.Types.ObjectId,
      ref: "Comment",
    },
    tweetId: {
      type: Schema.Types.ObjectId,
      ref: "Tweet",
    },
    originator: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

export const Comment = model("Likr", likeSchemea);
