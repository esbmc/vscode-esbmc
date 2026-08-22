## Verify the file

**ESBMC: Verify file** runs ESBMC over the open file with the flags from your
settings. On the example it finishes in well under a second and ends with:

```text
VERIFICATION FAILED
```

Every setting under `esbmc.*` maps to an ESBMC flag — solver, unwind bound,
which properties to check — so you can tighten or loosen the search without
leaving the editor.
