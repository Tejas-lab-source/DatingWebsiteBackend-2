class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.expected = true; // distinguishes "user did something wrong" from a real crash
  }
}
module.exports = ApiError;
