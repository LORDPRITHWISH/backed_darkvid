import { model, Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const viewSchema = new Schema(
  {
    videoId: { type: Schema.Types.ObjectId, ref: "Video", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    watchDuration: { type: Number, required: true }, // in seconds
  },
  { timestamps: true }
);

viewSchema.plugin(mongooseAggregatePaginate);

export const View = model("View", viewSchema);
