import { model, Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const ViewHistorySchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    videoId: {
      type: Schema.Types.ObjectId,
      ref: "Video",
      required: true,
      index: true,
    },

    // exact timestamp when the user opened the video
    viewedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    // the position user started watching from (resume point)
    startPosition: {
      type: Number,
      default: 0,
    },

    // the last position in THIS viewing session
    endPosition: {
      type: Number,
      default: 0,
    },

    // optional: device info / platform
    device: {
      type: String,
      default: "web",
    },
  },
  { timestamps: true }
);

ViewHistorySchema.plugin(mongooseAggregatePaginate);

export const ViewHistory = model("ViewHistory", ViewHistorySchema);
