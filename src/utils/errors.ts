export const unknownErrorToErrorLike = (error: unknown) => {
  if (error instanceof Error) {
    return error;
  }

  if (typeof error === "object" && error !== null && "toString" in error) {
    return new Error(error.toString());
  }

  if (typeof error === "string") {
    return new Error(error);
  }

  console.error(error);
  return new Error("unknown error");
};
