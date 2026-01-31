{ flake-utils, ... }@inputs:
flake-utils.lib.meld inputs [
  ./common.nix
  ./service.nix
  ./packages
  ./shells.nix
  ./transformers.nix
]
