{ self, nixpkgs, ... }:
let
  system = "x86_64-linux";
  pkgs = import nixpkgs { inherit system; };

  cuda-libs = pkgs.lib.makeLibraryPath (
    with pkgs;
    [
      addDriverRunpath.driverLink
      cudaPackages.cudatoolkit
      cudaPackages.cuda_nvrtc
      libGL
      glib
      cudaPackages.cudatoolkit
      cudaPackages.cudnn
      cudaPackages.cuda_cudart
    ]
  );
in
{
  devShells."${system}".default = pkgs.mkShell {
    buildInputs =
      with pkgs;
      [
        python312
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
      export LD_LIBRARY_PATH="${cuda-libs}:$LD_LIBRARY_PATH"

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
