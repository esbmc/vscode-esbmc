## Open the example

`examples/buffer-overflow.c` fills a four-element array in a loop that runs five
times:

```c
static void squares(int values[SIZE])
{
  for (int i = 0; i <= SIZE; i++)
    values[i] = i * i;
}
```

The last iteration writes `values[4]`, one past the end.

Whether a compiler notices depends on the optimisation level: `gcc -O2 -Wall`
reports `array subscript 4 is outside array bounds`, while `gcc -O0` and
`clang` at either level say nothing. Run it and it prints `9` and exits `0`.
ESBMC's answer does not depend on how you compiled it.
