{ 
  nixpkgs, 
  pyproject-nix, 
  uv2nix,
  pyproject-build-systems,
  ...
}:
let
  inherit (nixpkgs) lib;

  system = "x86_64-linux";
  pkgs = import nixpkgs { inherit system; };

  cuda-libs = with pkgs;
    [
      addDriverRunpath.driverLink
      cudaPackages.cudatoolkit
      cudaPackages.cuda_nvrtc
      libGL
      glib
      cudaPackages.cudatoolkit
      cudaPackages.cudnn
      cudaPackages.cuda_cudart
    ];

  cuda-libs-path = pkgs.lib.makeLibraryPath (cuda-libs);

  python = pkgs.python312;

  pythonBase = pkgs.callPackage pyproject-nix.build.packages {
    inherit python;
    stdenv = if pkgs.stdenv.isDarwin then pkgs.stdenv.override {
      targetPlatform = pkgs.stdenv.targetPlatform // {
        # Set macOS SDK version to 13.0 to match opencv-python wheel requirements
        darwinSdkVersion = "13.0";
      };
    } else pkgs.stdenv;
  };
  
  label-tool-workspace = uv2nix.lib.workspace.loadWorkspace { workspaceRoot = ../.; };
  label-tool-overlay = label-tool-workspace.mkPyprojectOverlay {
    sourcePreference = "wheel";  # Prefer binary wheels (like opencv-python) to avoid building from source
  };


  cudaOverride = final: prev: {
    # Target a specific Python package by its name in the set (e.g., 'your-project')
    "label-tool" = prev."label-tool".overrideAttrs (old: {
      # Append the required native system packages to nativeBuildInputs
      nativeBuildInputs = old.nativeBuildInputs ++ cuda-libs;
    });
  };
  
  label-tool-pythonSet = pythonBase.overrideScope (
    lib.composeManyExtensions [
        pyproject-build-systems.overlays.wheel
        label-tool-overlay
        cudaOverride
      ]
  );
  label-tool-env = label-tool-pythonSet.mkVirtualEnv "labeling-tool-env" label-tool-workspace.deps.default;
in
{
  packages.${system}.default = label-tool-env;

  devShells."${system}".default = pkgs.mkShell {
    buildInputs =
      with pkgs;
      [
        python
        python312Packages.cmake
        uv
        gcc
        clang
        clang-tools
        linuxHeaders
        llvmPackages.compiler-rt
        nixpkgs-fmt
        openssl
        pkg-config
        stdenv.cc.cc.lib
        cudaPackages.cudatoolkit
        cudaPackages.cuda_nvrtc
        cudaPackages.cuda_cccl
        zlib
        cudaPackages.cudatoolkit
        cudaPackages.cudnn
        cudaPackages.cuda_cudart
      ];

    CUDA_INCLUDE_DIRS = "${pkgs.cudatoolkit}/include";
    CUDA_LIBRARIES = "${pkgs.cudatoolkit}/lib";

    shellHook = ''
      export LD_LIBRARY_PATH="${cuda-libs-path}:$LD_LIBRARY_PATH"

      # check for .venv dir and create if it doesn't exist
      if [ ! -d ".venv" ]; then
        uv venv --clear
      fi

      uv sync
      source .venv/bin/activate

      uv pip install -e .
    '';
  };
}
