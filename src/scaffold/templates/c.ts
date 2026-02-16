import { ScaffoldTemplate } from '../templateRegistry';

export const cTemplate: ScaffoldTemplate = {
  language: 'c',
  files: [
    {
      path: 'Makefile',
      template: (name: string) => `CC = gcc
CFLAGS = -Wall -Wextra -std=c11
TARGET = ${name}

all: $(TARGET)

$(TARGET): main.c
\t$(CC) $(CFLAGS) -o $(TARGET) main.c

clean:
\trm -f $(TARGET)

.PHONY: all clean
`,
    },
    {
      path: 'main.c',
      template: () => `#include <stdio.h>

int main(void) {
    printf("Hello, world!\\n");
    return 0;
}
`,
      isMain: true,
    },
  ],
  runCommand: 'make && ./main',
};
