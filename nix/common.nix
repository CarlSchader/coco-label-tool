{ self, nixpkgs, flake-utils, sops-export, ...}:
flake-utils.lib.eachDefaultSystem  (system:
let
  pkgs = import nixpkgs {
    inherit system;
  };

  sops-export-pkg = sops-export.packages.${system}.default;

  libs = with pkgs; [
    addDriverRunpath.driverLink
    stdenv.cc.cc.lib
    zlib
    libGL
    glib
  ];

  core-packages = with pkgs; [
    python312
    python312Packages.cmake
    self.packages.${system}.transformers
    uv
    nodejs_24
    sops
    sops-export-pkg
    stdenv.cc.libc
  ];
in
{
  common = {
    libs = libs;
    core-packages = core-packages;
  };
})
