# 🏦 Loan Approval Prediction System

An end-to-end Machine Learning web application designed to predict loan eligibility with high accuracy using applicant financial and demographic parameters.

---

## 🌟 Key Features

- **Interactive Modern UI:** Responsive, financial-grade dashboard for loan officers and applicants.
- **Dual ML Models:**
  - **Random Forest Classifier:** Robust ensemble tree model for complex feature interactions.
  - **Logistic Regression:** Interpretable baseline classifier with probability scores.
- **Risk Assessment Breakdown:** Instant factor-by-factor breakdown explaining positive/negative credit risk drivers.
- **Live Dataset Explorer:** Paginated dataset viewer with instant search and status filtering.
- **On-Demand Model Retraining:** Retrain and refresh models directly from the web interface.

---

## 📊 Dataset Features

| Feature | Description |
| :--- | :--- |
| `Gender` | Male / Female |
| `Married` | Applicant marital status (Yes / No) |
| `Dependents` | Number of financial dependents (0, 1, 2, 3+) |
| `Education` | Graduate / Not Graduate |
| `Self_Employed` | Employment category (Yes / No) |
| `ApplicantIncome` | Primary applicant monthly income ($) |
| `CoapplicantIncome` | Additional co-applicant monthly income ($) |
| `LoanAmount` | Principal loan amount requested (in thousands $) |
| `Loan_Amount_Term` | Term duration of the loan in months |
| `Credit_History` | Guidelines compliance history (1.0 = Satisfactory, 0.0 = Subprime) |
| `Property_Area` | Property zone (Urban, Semiurban, Rural) |

---

## 🚀 Getting Started

### 1. Prerequisites
Ensure you have Python 3.10+ installed.

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Run Application
```bash
python app.py
```

Open [http://localhost:5050](http://localhost:5050) in your web browser.

---

## 📁 Project Structure

```
├── app.py                 # Flask server and prediction API
├── train_model.py         # Machine learning training & export pipeline
├── train_model.ipynb      # Exploratory data analysis & modeling notebook
├── train.csv              # Training dataset
├── requirements.txt       # Project dependencies
├── encoders.json          # Categorical mappings
├── metrics.json           # Model validation metrics
├── summary_stats.json     # Dataset statistical summaries
├── model_lr.joblib        # Pre-trained Logistic Regression model
├── model_rfc.joblib       # Pre-trained Random Forest model
├── static/                # CSS and JavaScript assets
└── templates/             # HTML templates
```
