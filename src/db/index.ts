import mongoose from "mongoose";
import { DB_NAME } from "../constants";


const connectDB = async () => {
    try {
        const connection_instance = await mongoose.connect(`${process.env.MONGO_URI}/${DB_NAME}`)
        console.log(`DB connected to ${connection_instance.connection.host}`);
        return connection_instance;

    } catch (error) {
        console.error("DB connection error",error);
        process.exit(1);
    }
}

export default connectDB;