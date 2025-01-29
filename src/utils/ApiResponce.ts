class ApiResponce {
  public success: boolean;

  constructor(
    public status: number = 200,
    public message: string = 'Success',
    public data: any
  ) {
    this.status = status;
    this.message = message;
    this.data = data;
    this.success = status < 300;
  }
}

export { ApiResponce };