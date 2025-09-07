import { model, Schema } from "mongoose";

const likeSchemea = new Schema(
  {
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

export const Like = model("Like", likeSchemea);
