import { ApiResponce } from "../utils/ApiResponce";
import { asyncHandeler } from "../utils/asyncHandelers";


const healthcheak = asyncHandeler(async (req, res) => {
    res.status(200).json(new ApiResponce(200, "Server is running", "OK"));
});

export { healthcheak };