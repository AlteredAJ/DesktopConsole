#include "PS5ModePresentationSubsystem.h"

void UPS5ModePresentationSubsystem::ApplyNativeState(
    FName Scene,
    FLinearColor Accent,
    FName Theme,
    bool bEnabled,
    FName Quality)
{
    CurrentState.Scene = Scene.IsNone() ? TEXT("idle") : Scene;
    CurrentState.Accent = Accent;
    CurrentState.Theme = Theme.IsNone() ? TEXT("blue") : Theme;
    CurrentState.bEnabled = bEnabled;
    CurrentState.Quality = Quality.IsNone() ? TEXT("premium") : Quality;
    OnPresentationChanged.Broadcast(CurrentState);
}
