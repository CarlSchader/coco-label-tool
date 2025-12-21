{ flake-utils, ... }@inputs:
flake-utils.lib.meld inputs [
  ./shells.nix
  ./packages.nix
  ./transformers.nix
  ./common.nix
  ./uv2nix.nix
]
