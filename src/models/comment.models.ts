import { model, Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const commentSchemea = new Schema(
  {
    content: {
      type: String,
      required: true,
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
    edited: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

commentSchemea.plugin(mongooseAggregatePaginate);

export const Comment = model("Comment", commentSchemea);
