{ flake-utils, ... }@inputs:
flake-utils.lib.meld inputs [
  ./packages
  ./shells.nix
  ./transformers.nix
  ./common.nix
]
