export class StorageNotFoundError extends Error {
  constructor(readonly key: string) {
    super('storage_object_not_found');
    this.name = 'StorageNotFoundError';
  }
}

export class StorageKeyInvalidError extends Error {
  constructor(readonly key: string) {
    super('storage_key_invalid');
    this.name = 'StorageKeyInvalidError';
  }
}
