using UnrealBuildTool;
public class PS5ModeOverlay : ModuleRules {
  public PS5ModeOverlay(ReadOnlyTargetRules Target) : base(Target) {
    PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
    PublicDependencyModuleNames.AddRange(new[] { "Core", "CoreUObject", "Engine", "UMG" });
  }
}
