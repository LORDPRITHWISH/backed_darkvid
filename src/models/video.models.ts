import { model, Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";
import { nanoid } from "nanoid";


const videoSchema = new Schema(
  {
    videoId: {
      type: String,
      unique: true,
    },
    videoURL: {
      type: String,
      required: true,
    },
    thumbnailURL: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
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
    likes: {
      type: Number,
      default: 0,
    },
    dislikes: {
      type: Number,
      default: 0,
    },
    comments: {
      type: Number,
      default: 0,
    },
    duration: {
      type: String,
      required: true,
    },
    isPublished: {
      type: Boolean,
      default: true,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
    }
  },
  { timestamps: true }
);

videoSchema.plugin(mongooseAggregatePaginate);

videoSchema.pre("save", async function (next) {
  if (!this.videoId) {
    this.videoId = nanoid(10);
  }
  next();
});

export const Video = model("Video", videoSchema);
