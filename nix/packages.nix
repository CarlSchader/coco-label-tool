{
  nixpkgs,
  flake-utils,
  pyproject-nix,
  uv2nix,
  pyproject-build-systems,
  ...
}:
flake-utils.lib.eachDefaultSystem (system:
let
  inherit (nixpkgs) lib;
  pkgs = import nixpkgs {
    inherit system;
  };
in
{})
