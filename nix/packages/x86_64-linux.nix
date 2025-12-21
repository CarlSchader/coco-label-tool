{
  nixpkgs,
  pyproject-nix,
  uv2nix,
  uv2nix_hammer_overrides,
  pyproject-build-systems,
  ...
}:
let
  system = "x86_64-linux";

  inherit (nixpkgs) lib;
  pkgs = import nixpkgs {
    inherit system;
    config = {
      allowUnfree = true;
    };
  };

  python = pkgs.python312;

  pythonBase = pkgs.callPackage pyproject-nix.build.packages {
    inherit python;
  };

  workspace = uv2nix.lib.workspace.loadWorkspace { workspaceRoot = ./../..; };

  overlay = workspace.mkPyprojectOverlay {
    sourcePreference = "wheel";
  };

  pyprojectOverrides = pkgs.lib.composeExtensions (uv2nix_hammer_overrides.overrides pkgs) (
    final: prev: {
      nvidia-cufile-cu12 = prev.nvidia-cufile-cu12.overrideAttrs (old: {
        buildInputs = (old.buildInputs or [ ]) ++ [ pkgs.rdma-core ];
      });

      nvidia-nvshmem-cu12 = prev.nvidia-nvshmem-cu12.overrideAttrs (old: {
        buildInputs =
          (old.buildInputs or [ ])
          ++ (with pkgs; [
            rdma-core
            pmix
            openmpi
            libfabric
            ucx
          ]);
      });

      torch = prev.torch.overrideAttrs (old: {
        buildInputs =
          (old.buildInputs or [ ])
          ++ (with pkgs; [
            cudaPackages.libcufile
            cudaPackages.libnvshmem
            cudaPackages.libcusparse_lt
          ]);
        autoPatchelfIgnoreMissingDeps = [ "libcuda.so.1" ]; # ignore because it's the CUDA driver provided by the host system
      });
    }
  );

  pythonSet' = pythonBase.overrideScope (
    lib.composeManyExtensions [
      pyproject-build-systems.overlays.wheel
      overlay
    ]
  );

  # Override host packages with build fixups
  pythonSet = pythonSet'.pythonPkgsHostHost.overrideScope pyprojectOverrides;

  venv = pythonSet.mkVirtualEnv "coco-label-tool" workspace.deps.default;
in
{
  packages.${system}.default = pkgs.runCommand "coco-label-tool" { } ''
    mkdir -p $out/bin
    ln -s ${venv}/bin/server $out/bin/coco-label-tool
  '';
}
