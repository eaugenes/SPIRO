# Re-running the Device B pipeline
Requires Python 3 with pandas, openpyxl, numpy and scikit-learn.

    mkdir raw output && unzip Tuberculosis_DS.zip -d raw
    python3 clean.py raw output       # -> output/cleaned_tb_data.csv
    python3 add_fhsis_2019.py FHSIS2019.pdf output   # adds 2019 (needs pdftotext from poppler)
    python3 model.py output           # -> output/tb_predictions.csv, output/model_evaluation.json
    python3 validate.py output        # checks all four files against the contract

data_dictionary.md is hand-written; update it if the inputs change.
    python3 verify_model.py output    # independently recomputes metrics and predictions (numpy only)

On a fresh machine, install scikit-learn first: pip install pandas openpyxl scikit-learn
