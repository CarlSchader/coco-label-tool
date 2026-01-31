{ self, ... }:
{
  nixosModules.service = { lib, config, pkgs, ... }: {
    options.enable = lib.mkOption {
      type = lib.types.bool;
      description = "Enable the Docs Book service";
      default = false;
    };

    options.host = lib.mkOption {
      type = lib.types.str;
      description = "Hostname to listen on for HTTP connections";
      default = "localhost";
      example = "localhost";
    };

    options.port = lib.mkOption {
      type = lib.types.str;
      description = "Port to use for HTTP connections";
      default = "8000";
      example = "8000";
    };

    options.auto-label-config = lib.mkOption {
      type = lib.types.str;
      description = "Path to auto-labeling YAML config file";
      default = "";
      example = "/etc/coco-label-tool/auto-label-config.yaml";
    };

    options.service-name = lib.mkOption {
      type = lib.types.str;
      description = "name of the systemd service";
      default = "coco-label-tool";
      example = "custom-label-server";
    };

    config = {
      systemd.services.${config.service-name} = lib.mkIf config.enable {
        description = "coco label tool service";
        after = [ "network.target" ];
        wantedBy = [ "multi-user.target" ];
        serviceConfig = {
          ExecStart = ''
            ${self.packages.${pkgs.system}.default}/bin/coco-label-tool --host ${config.host} --port ${config.port} --auto-label-config ${config.auto-label-config}
          '';
          Restart = "on-failure";
        };
      };
    };
  };
}
