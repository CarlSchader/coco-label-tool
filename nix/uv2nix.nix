{
  self,
  nixpkgs,
  flake-utils,
  pyproject-nix,
  uv2nix,
  pyproject-build-systems,
  ...
}:
flake-utils.lib.eachDefaultSystem ( system:
let
  inherit (nixpkgs) lib;
  pkgs = import nixpkgs {
    inherit system;
  };
  
  python = pkgs.python312;

  pythonBase = pkgs.callPackage pyproject-nix.build.packages {
    inherit python;
  };
 
  workspace = uv2nix.lib.workspace.loadWorkspace { workspaceRoot = ./..; };

  overlay = workspace.mkPyprojectOverlay {
    sourcePreference = "wheel";
  };

  
  dependencies-overlay = final: prev: lib.optionalAttrs (pkgs.stdenv.isLinux && pkgs.stdenv.isx86_64) {
    nvidia-cufile-cu12 = prev.nvidia-cufile-cu12.overrideAttrs (old: { # Fix for NVIDIA cufile RDMA dependencies (only needed on Linux x86_64)
      autoPatchelfIgnoreMissingDeps = [ "libmlx5.so.1" "librdmacm.so.1" "libibverbs.so.1" ];
    });

    torchvision = prev.torchvision.overrideAttrs (old: { # use torch deps which are being build by uv2nix
      buildInputs = (old.buildInputs or []) ++ [ final.torch ];
    });
  };



  pythonSet = pythonBase.overrideScope (
    lib.composeManyExtensions [
      pyproject-build-systems.overlays.wheel
      overlay
      dependencies-overlay
    ]
  );
in 
{
  packages.uv2nix = pythonSet.mkVirtualEnv "coco-label-tool" workspace.deps.default;
})
