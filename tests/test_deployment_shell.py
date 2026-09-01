import os
import shutil
import subprocess
from pathlib import Path

import pytest


PROJECT_ROOT = Path(__file__).resolve().parents[1]
COMMON_SH = PROJECT_ROOT / 'deployment' / 'common.sh'
SHELL_SCRIPTS = tuple((PROJECT_ROOT / 'deployment').glob('*.sh'))


def find_bash():
    discovered = shutil.which('bash')
    if discovered:
        return Path(discovered)

    program_files = os.environ.get('ProgramFiles')
    if program_files:
        candidate = Path(program_files) / 'Git' / 'bin' / 'bash.exe'
        if candidate.is_file():
            return candidate
    return None


BASH = find_bash()


@pytest.mark.skipif(BASH is None, reason='Bash is unavailable')
@pytest.mark.parametrize('script_path', SHELL_SCRIPTS, ids=lambda path: path.name)
def test_deployment_shell_scripts_parse(script_path):
    result = subprocess.run(
        [str(BASH), '-n', script_path.as_posix()],
        capture_output=True,
        encoding='utf-8',
        errors='replace',
        timeout=30,
        check=False,
    )

    assert result.returncode == 0, result.stderr


def test_env_is_hardened_and_verified_before_database_backup():
    source = COMMON_SH.read_text(encoding='utf-8')
    function_start = source.index('archub_secure_env_file() {')
    function_end = source.index('\n}\n', function_start)
    function_body = source[function_start:function_end]

    first_symlink_check = function_body.index('[ ! -L "$archub_env_path" ]')
    chmod_call = function_body.index('chmod 600 -- "$archub_env_path"')
    second_symlink_check = function_body.index(
        '[ ! -L "$archub_env_path" ]', first_symlink_check + 1
    )
    stat_call = function_body.index("stat -c '%a:%u' -- \"$archub_env_path\"")
    mode_check = function_body.index("[ \"$archub_env_mode\" = '600' ]")
    owner_check = function_body.index(
        '[ "$archub_env_owner_uid" = "$archub_expected_uid" ]'
    )

    assert first_symlink_check < chmod_call < second_symlink_check
    assert second_symlink_check < stat_call < mode_check < owner_check

    backup_start = source.index('archub_create_backup() {')
    hardening_call = source.index(
        'archub_secure_env_file "$ARCHUB_APP_ROOT/.env"', backup_start
    )
    helper_call = source.index('backup-database', hardening_call)
    assert hardening_call < helper_call
