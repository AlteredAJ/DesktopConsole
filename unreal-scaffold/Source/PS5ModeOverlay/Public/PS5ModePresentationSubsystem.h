#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "PS5ModePresentationSubsystem.generated.h"

/** Semantic state sent by the native host to Unreal's optional presentation layer. */
USTRUCT(BlueprintType)
struct FPS5ModePresentationState
{
    GENERATED_BODY()

    /** `home`, `idle`, or `game`; presentation blueprints decide the scene. */
    UPROPERTY(BlueprintReadOnly, Category = "PS5 Mode") FName Scene = TEXT("idle");
    UPROPERTY(BlueprintReadOnly, Category = "PS5 Mode") FLinearColor Accent = FLinearColor(0.302f, 0.612f, 1.0f, 1.0f);
    UPROPERTY(BlueprintReadOnly, Category = "PS5 Mode") FName Theme = TEXT("blue");
    UPROPERTY(BlueprintReadOnly, Category = "PS5 Mode") bool bEnabled = true;
    UPROPERTY(BlueprintReadOnly, Category = "PS5 Mode") FName Quality = TEXT("premium");
};

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FPS5ModePresentationChanged, const FPS5ModePresentationState&, State);

/** Blueprint-facing endpoint for the optional Home/Idle presentation layer. */
UCLASS()
class PS5MODEOVERLAY_API UPS5ModePresentationSubsystem final : public UGameInstanceSubsystem
{
    GENERATED_BODY()

public:
    UPROPERTY(BlueprintAssignable, Category = "PS5 Mode") FPS5ModePresentationChanged OnPresentationChanged;

    UFUNCTION(BlueprintCallable, Category = "PS5 Mode")
    void ApplyNativeState(FName Scene, FLinearColor Accent, FName Theme, bool bEnabled, FName Quality);

    UFUNCTION(BlueprintPure, Category = "PS5 Mode")
    FPS5ModePresentationState GetPresentationState() const { return CurrentState; }

private:
    FPS5ModePresentationState CurrentState;
};
