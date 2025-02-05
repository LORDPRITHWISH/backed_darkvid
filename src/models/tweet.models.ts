import { model, Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const tweetsSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
    },
    content: {
      type: String,
    },
    featuredImage: {
      type: String,
    },
    featuredVideo: {
      type: String,
    },
    referedTweet: {
      type: Schema.Types.ObjectId,
      ref: "Tweet",
    },
    referedVideo: {
      type: Schema.Types.ObjectId,
      ref: "Video",
    },
    originator: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    likes: {
      type: Number,
      default: 0,
    },
    retweets: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

tweetsSchema.plugin(mongooseAggregatePaginate);

export const Tweet = model("Tweet", tweetsSchema);