# Dev Instructions

## Visualize Typedoc Documentation

In the root directory, run:

```bash
pnpm run docs:watch
```

In a new terminal window, run:

```bash
pnpx http-server generated/docs
```

or

```bash
cd generated/docs
python -m http.server 8080
```

Open `http://localhost:8080` in your browser to view the documentation.

## README Examples

Version history of the README examples is tracked at [`../examples/code-snippets`](../examples/code-snippets).

<!-- 

Temporarily commented out. The mentioned packages were committed for now to prevent the `pnpm docs:watch` command from failing due to linting errors. This should be reverted once there's a way to exclude the `./examples/` directory from TypeDoc compilation.

### Dependencies

To read or write `examples/code-snippets`, you may need to temporarily install dependencies to ensure code correctness. **Do not commit any changes to `package.json` or `pnpm-lock.yaml`** resulting from these temporary installations.

```bash
pnpm install -D ethers
pnpm install -D bitcoinjs-lib
pnpm install -D axios
``` 

-->
