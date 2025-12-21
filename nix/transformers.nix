{
  nixpkgs,
  flake-utils,
  ...
}:
flake-utils.lib.eachDefaultSystem (
  system:
  let
    pkgs = import nixpkgs { inherit system; };

    huggingfaceHubOverride = pythonPkgsBase.huggingface-hub.overrideAttrs (oldAttrs: {
      version = "1.2.1";
      src = pkgs.fetchPypi {
        pname = "huggingface_hub";
        version = "1.2.1";
        sha256 = "sha256-Gs7QYfob1EPA7ICkr0Mri3AEHVSGD3rzNM7/WZYRpBU=";
      };
      propagatedBuildInputs = with pythonPkgsBase; [
        httpx
        shellingham
        typer-slim
        click
        filelock
        fsspec
        hf-xet
        pyyaml
        tqdm
      ];
    });

    pythonPkgsBase = pkgs.python312Packages;
    pythonPkgs = pythonPkgsBase.overrideScope (
      self: super: {
        huggingface-hub = huggingfaceHubOverride;
      }
    );
  in
  {
    packages.transformers = pythonPkgs.buildPythonPackage {
      pname = "transformers";
      version = "1.0.0";

      src = pkgs.fetchFromGitHub {
        owner = "huggingface";
        repo = "transformers";
        rev = "main";
        sha256 = "sha256-L5nCYqEhFthaoQvWUJurmu15cLvcz80W3DQ3SqSBdLI=";
      };

      pyproject = true;

      nativeBuildInputs = with pythonPkgs; [
        setuptools
        wheel
      ];

      propagatedBuildInputs = with pythonPkgs; [
        filelock
        huggingface-hub
        numpy
        pyyaml
        regex
        requests
        tokenizers
        typer-slim
        safetensors
        tqdm
      ];
    };
  }
)
