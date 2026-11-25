import { ChangeEvent } from "react";
import { BsmButton } from "renderer/components/shared/bsm-button.component";

type Props = {
    value: string;
    label: string;
    placeholder?: string;
    canApply: boolean;
    onChange: (value: string) => void;
    onApply: () => void;
};

export function SettingTextInput({ value, label, placeholder, canApply, onChange, onApply }: Readonly<Props>) {
    const handleChange = (event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value);

    return (
        <div className="relative flex items-center w-full h-8 bg-light-main-color-1 dark:bg-main-color-1 rounded-md pl-2 py-1">
            <input
                aria-label={label}
                className="min-w-0 grow bg-transparent outline-none"
                value={value}
                placeholder={placeholder}
                onChange={handleChange}
                spellCheck={false}
            />
            <BsmButton onClick={onApply} disabled={!canApply} className="shrink-0 whitespace-nowrap mr-2 px-2 font-bold italic text-sm rounded-md" text="misc.apply" withBar={false} />
        </div>
    );
}
