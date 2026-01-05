import { model, Schema } from "mongoose";

const subsriptionSchema = new Schema({
    subscriber: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    subscribedTo: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    isPublic: {
        type: Boolean, // whether the user wants to display who they are subscribed to
        default: true,
    },
}, { timestamps: true });

export const Subscription = model("Subscription", subsriptionSchema);