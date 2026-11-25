export class SchoolAssetValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SchoolAssetValidationError';
  }
}

