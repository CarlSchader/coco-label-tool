{ self, ... }:
{
  nixosModules.service = { lib, config, pkgs, ... }: 
  {
    options.services.coco-label-tool = lib.mkOption {
      type = lib.types.attrsOf (lib.types.submodule {
        options = {
          enable = lib.mkOption {
            type = lib.types.bool;
            description = "Enable the Docs Book service";
            default = false;
          };

          coco-file = lib.mkOption {
            type = lib.types.str;
            description = "Path to COCO json file";
            example = "/var/lib/dataset/coco.json";
          };

          host = lib.mkOption {
            type = lib.types.str;
            description = "Hostname to listen on for HTTP connections";
            default = "localhost";
            example = "localhost";
          };

          port = lib.mkOption {
            type = lib.types.str;
            description = "Port to use for HTTP connections";
            default = "8000";
            example = "8000";
          };

          auto-label-config = lib.mkOption {
            type = lib.types.str;
            description = "Path to auto-labeling YAML config file";
            default = "";
            example = "/etc/coco-label-tool/auto-label-config.yaml";
          };
        };
      });
    };

    config = {
      systemd.services = lib.mapAttrs' (name: cfg: lib.nameValuePair name {
        description = "${name} service";
        after = [ "network.target" ];
        wantedBy = [ "multi-user.target" ];
        serviceConfig = {
          ExecStart = ''
            ${self.packages.${pkgs.system}.default}/bin/coco-label-tool --host ${cfg.host} --port ${cfg.port} --auto-label-config ${cfg.auto-label-config}
          '';
          Restart = "on-failure";
        };
      }) config.services.coco-label-tool;
    };
  };
}
