extern int nondet_int(void);
int main(void)
{
  int x = nondet_int();
  int y = nondet_int();
  if (x > 10 && y < -5) {
    __ESBMC_assert(x + y != 3, "sum must not be 3");
  }
  return 0;
}
