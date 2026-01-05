import { model, Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const viewSchema = new Schema(
  {
    videoId: {
      type: Schema.Types.ObjectId,
      ref: "Video",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    lastPosition: {
      type: Number,
      default: 0, // seconds
    },
    totalWatchTime: {
      type: Number,
      default: 0,
    },
    completed: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

viewSchema.index({ userId: 1, videoId: 1 }, { unique: true });

viewSchema.plugin(mongooseAggregatePaginate);

export const View = model("View", viewSchema);
