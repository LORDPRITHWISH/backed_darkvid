import mongoose, {isValidObjectId} from "mongoose"
import {ApiError} from "../utils/ApiError.js"
import { asyncHandeler } from "../utils/asyncHandelers.js"
import { ApiResponce } from "../utils/ApiResponce.js";
import { redisClient } from "../utils/redis.js";


const Test = asyncHandeler(async (req, res) => {
  // await redisClient.set("dark", "666");
  // await redisClient.SETEX("dark", 600, "Death to all humans");
  // const value = await redisClient.get("dark");

  // redisClient.hSetEx("darkHex", { name: "DarkLord", role: "dev" }, { EX: 60 });

//   await redisClient.hSetEx(
//     "dark",
//     { name: "DarkLord", role: "dev" },
//     {
//       expiration: { type: "EX", value: 60 }, // expire in 60s
//       mode: "FNX", // only add if fields don't exist
//     }
//   );
// // 

await redisClient
.multi()
.hSet("dark", { name: "DarkLord", role: "dev" })
.expire("dark", 60)
.exec();

const value = await redisClient.hGetAll("dark");
// const value = await redisClient.info("server");
// console.log(info.match(/redis_version:(.*)/)[1]);
// console.log(value)


  return res.status(200).json(new ApiResponce(200, "Test route is working", { value }));
});

export {
  Test
}
