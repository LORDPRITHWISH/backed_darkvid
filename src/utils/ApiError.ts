class ApiError extends Error {
  code: number;
  data: any;
  success: boolean;
  errors: any[];
  
  constructor(code: number, message: string = "something went wrong",errors=[],stack:string="") {
    super(message);
    this.code = code;
    this.data = null;
    this.message = message;
    this.success = false;
    this.errors = errors;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, ApiError);
    }
  }
}

export { ApiError };
