SIZE: int = 4


# last_square() indexes one element past the end of `values`, so the read is
# out of range. ESBMC reports it as an uncaught IndexError, reached from
# main(), rather than waiting for an input that happens to trigger it.
def last_square(values: list[int]) -> int:
    return values[SIZE]


def main() -> None:
    values: list[int] = [0, 1, 4, 9]
    print(last_square(values))


main()
