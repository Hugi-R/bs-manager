import { useEffect, useRef, useState } from "react";
import { lastValueFrom, Observable } from "rxjs";
import { BSVersion } from "shared/bs-version.interface";
import { BsArm64InstallOptions, BsArm64Progress, BsArm64Status, BsArm64Unsupported, DEFAULT_BS_ARM64_REPOSITORY } from "shared/models/bs-arm64/bs-arm64.model";
import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { BsmCheckbox } from "renderer/components/shared/bsm-checkbox.component";
import { BsmLink } from "renderer/components/shared/bsm-link.component";
import { useService } from "renderer/hooks/use-service.hook";
import { useTranslationV2 } from "renderer/hooks/use-translation.hook";
import { BsArm64Service } from "renderer/services/bs-arm64.service";
import { IpcService } from "renderer/services/ipc.service";
import { NotificationService } from "renderer/services/notification.service";

type Props = {
    version: BSVersion;
    status: BsArm64Status;
    onStatusChange: () => void;
};

const MAX_LOG_LINES = 300;

// A release source without the native runtime shouldn't block a local tarball install
function allowsLocalInstall(status?: BsArm64Status): boolean {
    if (!status) {
        return false;
    }
    return status.unsupported === undefined
        || status.unsupported === BsArm64Unsupported.NO_RELEASE
        || status.unsupported === BsArm64Unsupported.VERSION_NOT_SUPPORTED;
}

export function Arm64Slide({ version, status, onStatusChange }: Props) {
    const { text: t } = useTranslationV2();
    const arm64 = useService(BsArm64Service);
    const notification = useService(NotificationService);
    const ipc = useService(IpcService);

    const [mods, setMods] = useState(true);
    const [busy, setBusy] = useState(false);
    const [percent, setPercent] = useState<number>();
    const [logLines, setLogLines] = useState<string[]>([]);
    const logRef = useRef<HTMLPreElement>(null);

    // Mod support needs a BSIPA version the release was tested with
    const modsAvailable = !status?.modsUnavailable;

    useEffect(() => {
        if (!modsAvailable) {
            setMods(false);
        } else if (status?.installed) {
            setMods(status.mods);
        }
    }, [status?.installed, status?.mods, modsAvailable]);

    useEffect(() => {
        logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
    }, [logLines]);

    const runInstall = (options: BsArm64InstallOptions, successKey: string) => {
        setBusy(true);
        setLogLines([]);
        setPercent(undefined);

        arm64.install(version, options).subscribe({
            next: p => {
                if (p.percent !== undefined) {
                    setPercent(p.percent);
                }
                if (p.log) {
                    setLogLines(lines => [...lines, p.log].slice(-MAX_LOG_LINES));
                }
            },
            error: (e: { code?: string; message?: string }) => {
                setBusy(false);
                setLogLines(lines => [...lines, e?.message ?? String(e)]);
                const code = e?.code?.startsWith("BS_ARM64_") ? e.code : "BS_ARM64_INSTALLER_FAILED";
                notification.notifyError({
                    title: `pages.version-viewer.arm64.errors.${code}`,
                    desc: e?.message,
                });
                onStatusChange();
            },
            complete: () => {
                setBusy(false);
                setPercent(undefined);
                notification.notifySuccess({ title: `pages.version-viewer.arm64.notifications.${successKey}-success` });
                onStatusChange();
            },
        });
    };

    const run = (action: "install" | "uninstall") => {
        if (action === "install") {
            runInstall({ mods }, "install");
            return;
        }
        const obs: Observable<BsArm64Progress> = arm64.uninstall(version);

        setBusy(true);
        setLogLines([]);
        setPercent(undefined);

        obs.subscribe({
            next: p => {
                if (p.percent !== undefined) {
                    setPercent(p.percent);
                }
                if (p.log) {
                    setLogLines(lines => [...lines, p.log].slice(-MAX_LOG_LINES));
                }
            },
            error: (e: { code?: string; message?: string }) => {
                setBusy(false);
                setLogLines(lines => [...lines, e?.message ?? String(e)]);
                const code = e?.code?.startsWith("BS_ARM64_") ? e.code : "BS_ARM64_INSTALLER_FAILED";
                notification.notifyError({
                    title: `pages.version-viewer.arm64.errors.${code}`,
                    desc: e?.message,
                });
                onStatusChange();
            },
            complete: () => {
                setBusy(false);
                setPercent(undefined);
                notification.notifySuccess({ title: `pages.version-viewer.arm64.notifications.${action}-success` });
                onStatusChange();
            },
        });
    };

    const pickTarball = async () => {
        const res = await lastValueFrom(ipc.sendV2("open-dialog", {
            title: t("pages.version-viewer.arm64.install-tarball"),
            properties: ["openFile"],
            filters: [{ name: "bs-arm64", extensions: ["tar.gz", "tgz"] }],
        }));
        const tarballPath = res?.filePaths?.[0];
        if (tarballPath) {
            runInstall({ mods, tarballPath }, "install");
        }
    };

    const reinstallNeeded = status?.installed && !status.ready;
    const repository = status?.repository ?? DEFAULT_BS_ARM64_REPOSITORY;
    const localInstallable = allowsLocalInstall(status);

    return (
        <div className="w-full shrink-0 px-3 pb-3 flex flex-col items-center">
            <div className="w-full max-w-3xl h-full flex flex-col gap-3 bg-light-main-color-2 dark:bg-main-color-2 rounded-md p-4 text-gray-800 dark:text-gray-200 overflow-hidden">
                <div className="flex flex-col gap-1">
                    <h2 className="text-xl font-bold uppercase tracking-wide">{t("pages.version-viewer.arm64.title")}</h2>
                    <p className="text-sm">{t("pages.version-viewer.arm64.description")}</p>
                </div>

                {status?.unsupported ? (
                    <p className="text-sm font-bold text-red-500">
                        {t(`pages.version-viewer.arm64.unsupported.${status.unsupported}`, {
                            versions: status.supportedVersions?.join(", ") ?? "?",
                            proton: status.protonVersion ?? "?",
                        })}
                    </p>
                ) : (
                    <>
                        <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                            <span className="font-bold">{t("pages.version-viewer.arm64.status")}</span>
                            <span>
                                {status?.installed
                                    ? t(status.mods ? "pages.version-viewer.arm64.installed-mods" : "pages.version-viewer.arm64.installed-no-mods", { release: status.installedRelease ?? "?" })
                                    : t("pages.version-viewer.arm64.not-installed")}
                            </span>
                            <span className="font-bold">Proton</span>
                            <span>{status?.protonVersion ?? "?"}</span>
                        </div>

                        {reinstallNeeded && (
                            <p className="text-sm font-bold text-yellow-500">{t("pages.version-viewer.arm64.reinstall-needed")}</p>
                        )}

                        <div className="flex items-center gap-2 text-sm w-fit">
                            <BsmCheckbox className="h-5 w-5 relative" checked={mods} disabled={busy || !modsAvailable} onChange={setMods} />
                            <span>{t("pages.version-viewer.arm64.mod-support")}</span>
                        </div>
                        {!modsAvailable && (
                            <p className="text-sm text-yellow-500">
                                {t(`pages.version-viewer.arm64.mods-unavailable.${status.modsUnavailable}`, { bsipa: status.bsipaVersion ?? "?" })}
                            </p>
                        )}

                        <div className="flex gap-2">
                            <BsmButton
                                className="px-4 py-1 rounded-md"
                                typeColor="primary"
                                withBar={false}
                                disabled={busy}
                                text={status?.installed ? "pages.version-viewer.arm64.reinstall" : "pages.version-viewer.arm64.install"}
                                onClick={() => run("install")}
                            />
                            {localInstallable && (
                                <BsmButton
                                    className="px-4 py-1 rounded-md"
                                    typeColor="primary"
                                    withBar={false}
                                    disabled={busy}
                                    text="pages.version-viewer.arm64.install-tarball"
                                    onClick={pickTarball}
                                />
                            )}
                            {status?.installed && (
                                <BsmButton
                                    className="px-4 py-1 rounded-md"
                                    typeColor="error"
                                    withBar={false}
                                    disabled={busy}
                                    text="pages.version-viewer.arm64.uninstall"
                                    onClick={() => run("uninstall")}
                                />
                            )}
                            {busy && percent !== undefined && <span className="self-center text-sm">{percent}%</span>}
                        </div>

                        <pre ref={logRef} className="grow min-h-24 overflow-auto text-xs bg-light-main-color-3 dark:bg-main-color-1 rounded-md p-2 whitespace-pre-wrap">
                            {logLines.length ? logLines.join("\n") : t("pages.version-viewer.arm64.log-placeholder")}
                        </pre>
                    </>
                )}

                <BsmLink className="text-sm underline w-fit" href={`https://github.com/${repository}`}>
                    github.com/{repository}
                </BsmLink>
            </div>
        </div>
    );
}
