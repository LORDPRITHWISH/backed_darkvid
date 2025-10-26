import { model, Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";
// import { nanoid } from "nanoid";
import { customAlphabet } from "nanoid";

const videoSchema = new Schema(
  {
    videoId: {
      type: String,
      // unique: true,
    },
    videoKey: {
      type: String,
      required: true,
    },
    thumbnailID: {
      type: String,
      // required: true,
    },
    title: {
      type: String,
      // required: true,
    },
    description: {
      type: String,
    },
    tags: {
      type: [String],
    },
    views: {
      type: Number,
      default: 0,
    },
    privacy: {
      type: String,
      enum: ["public", "private", "unlisted"],
      default: "public",
    },
    duration: {
      type: String,
      // required: true,
    },
    isPublished: {
      type: Boolean,
      default: false,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    status: {
      type: String,
      enum: ["uploading", "completed", "failed"],
      default: "uploading",
    },
  },
  { timestamps: true }
);

videoSchema.plugin(mongooseAggregatePaginate);

videoSchema.pre("save", async function (next) {
  // Letters + numbers only
  const alphanumeric = customAlphabet(
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
    10
  );

  if (!this.videoId) {
    this.videoId = alphanumeric();
  }

  next();
});

export const Video = model("Video", videoSchema);
