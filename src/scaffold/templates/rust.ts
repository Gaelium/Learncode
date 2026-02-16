import { ScaffoldTemplate } from '../templateRegistry';

export const rustTemplate: ScaffoldTemplate = {
  language: 'rust',
  files: [
    {
      path: 'Cargo.toml',
      template: (name: string) => `[package]
name = "${name}"
version = "0.1.0"
edition = "2021"
`,
    },
    {
      path: 'src/main.rs',
      template: () => `fn main() {
    println!("Hello, world!");
}
`,
      isMain: true,
    },
  ],
  runCommand: 'cargo run',
};
