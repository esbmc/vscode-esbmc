#include <stdio.h>

#define SIZE 4

/*
 * squares() walks one element past the end of `values`, so the last write
 * is out of bounds. ESBMC reports it as an array bounds violation at the
 * write, naming the file, line and column.
 */
static void squares(int values[SIZE])
{
  for (int i = 0; i <= SIZE; i++)
    values[i] = i * i;
}

int main(void)
{
  int values[SIZE];

  squares(values);
  printf("%d\n", values[SIZE - 1]);
  return 0;
}
