## Read the counterexample

A failure names the property, where it is, and what class of bug it is:

```text
Violated property:
  file examples/buffer-overflow.c line 13 column 5 function squares
  dereference failure: array bounds violated
  CWE: CWE-121, CWE-125, CWE-129, CWE-131, CWE-193, CWE-787
```

Below it, ESBMC lists every property it checked:

```text
  PASSED   [squares.assertion.1]              line 13  ... Incorrect alignment ...
  FAILED   [squares.array-bounds-violated.1]  line 13  dereference failure: array bounds violated

** 1 of 2 properties failed, 1 passed
```

The trace above the property is short because ESBMC slices away every
assignment the property does not depend on. Run with `--no-slice` if you want
the full sequence of states and variable values instead.

Change `i <= SIZE` to `i < SIZE` and verify again — ESBMC reports
`VERIFICATION SUCCESSFUL`, meaning it proved no such write exists on any
execution, not merely that it failed to find one.
