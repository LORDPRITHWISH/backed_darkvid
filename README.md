# backed_darkvid

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run src/ dindex.ts
```

This project was created using `bun init` in bun v1.1.45. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.

## Object storage provider switch (AWS / Vultr)

Set `OBJECT_STORAGE_PROVIDER` in `.env`:

- `OBJECT_STORAGE_PROVIDER=aws` (default)
- `OBJECT_STORAGE_PROVIDER=vultr`

To rollback from Vultr to AWS, set `OBJECT_STORAGE_PROVIDER=aws` again and keep AWS keys configured.
