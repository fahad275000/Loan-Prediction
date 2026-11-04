import os
import json
import re
import pandas as pd
import numpy as np
import joblib
from flask import Flask, render_template, request, jsonify
from train_model import train_and_export

app = Flask(__name__)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

def load_resources():
    lr_path = os.path.join(BASE_DIR, 'model_lr.joblib')
    rfc_path = os.path.join(BASE_DIR, 'model_rfc.joblib')
    encoders_path = os.path.join(BASE_DIR, 'encoders.json')
    metrics_path = os.path.join(BASE_DIR, 'metrics.json')
    stats_path = os.path.join(BASE_DIR, 'summary_stats.json')

    if not all(os.path.exists(p) for p in [lr_path, rfc_path, encoders_path, metrics_path, stats_path]):
        train_and_export()

    model_lr = joblib.load(lr_path)
    model_rfc = joblib.load(rfc_path)

    with open(encoders_path, 'r') as f:
        encoders = json.load(f)
    with open(metrics_path, 'r') as f:
        metrics = json.load(f)
    with open(stats_path, 'r') as f:
        stats = json.load(f)

    return model_lr, model_rfc, encoders, metrics, stats

model_lr, model_rfc, encoders, metrics, stats = load_resources()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/stats', methods=['GET'])
def get_stats():
    global metrics, stats
    return jsonify({
        'metrics': metrics,
        'summary': stats
    })

@app.route('/api/dataset', methods=['GET'])
def get_dataset():
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 15))
    search = request.args.get('search', '').strip().lower()
    status_filter = request.args.get('status', 'all')

    df = pd.read_csv(os.path.join(BASE_DIR, 'train.csv'))

    if status_filter in ['Y', 'N']:
        df = df[df['Loan_Status'] == status_filter]

    if search:
        mask = (
            df['Loan_ID'].str.lower().str.contains(search, na=False) |
            df['Property_Area'].str.lower().str.contains(search, na=False) |
            df['Education'].str.lower().str.contains(search, na=False)
        )
        df = df[mask]

    total = len(df)
    start = (page - 1) * per_page
    end = start + per_page
    records = df.iloc[start:end].replace({np.nan: None}).to_dict(orient='records')

    return jsonify({
        'records': records,
        'total': total,
        'page': page,
        'per_page': per_page,
        'total_pages': int(np.ceil(total / per_page)) if total > 0 else 1
    })

@app.route('/api/predict', methods=['POST'])
def predict():
    global model_lr, model_rfc, encoders
    data = request.get_json() or {}

    try:
        model_type = data.get('model_type', 'lr')
        model = model_rfc if model_type == 'rfc' else model_lr

        # Extract features
        gender = str(data.get('Gender', 'Male'))
        married = str(data.get('Married', 'Yes'))
        dependents_raw = str(data.get('Dependents', '0'))
        dependents = int(re.sub(r'[^0-9]', '', dependents_raw) or '0')
        education = str(data.get('Education', 'Graduate'))
        self_employed = str(data.get('Self_Employed', 'No'))
        applicant_income = float(data.get('ApplicantIncome', 5000))
        coapplicant_income = float(data.get('CoapplicantIncome', 0))
        loan_amount = float(data.get('LoanAmount', 120))
        loan_amount_term = float(data.get('Loan_Amount_Term', 360))
        credit_history = float(data.get('Credit_History', 1.0))
        property_area = str(data.get('Property_Area', 'Urban'))

        # Map categoricals using encoders
        gender_enc = encoders['Gender']['mapping'].get(gender, 1)
        married_enc = encoders['Married']['mapping'].get(married, 1)
        education_enc = encoders['Education']['mapping'].get(education, 0)
        self_employed_enc = encoders['Self_Employed']['mapping'].get(self_employed, 0)
        property_enc = encoders['Property_Area']['mapping'].get(property_area, 2)

        # Feature vector order:
        # ['Gender', 'Married', 'Dependents', 'Education', 'Self_Employed',
        #  'ApplicantIncome', 'CoapplicantIncome', 'LoanAmount', 'Loan_Amount_Term',
        #  'Credit_History', 'Property_Area']
        features = np.array([[
            gender_enc,
            married_enc,
            dependents,
            education_enc,
            self_employed_enc,
            applicant_income,
            coapplicant_income,
            loan_amount,
            loan_amount_term,
            credit_history,
            property_enc
        ]])

        prediction = model.predict(features)[0]
        probabilities = model.predict_proba(features)[0]

        # In LabelEncoder, N=0, Y=1
        prob_approved = round(float(probabilities[1]) * 100, 2)
        prob_rejected = round(float(probabilities[0]) * 100, 2)
        is_approved = bool(prediction == 1)

        # Qualitative Risk factors
        key_factors = []
        total_income = applicant_income + coapplicant_income
        dti_estimate = (loan_amount * 1000 / loan_amount_term) / (total_income + 1e-5)

        if credit_history >= 1.0:
            key_factors.append({
                'factor': 'Credit History',
                'impact': 'Positive',
                'description': 'Excellent credit track record meets lending compliance guidelines.'
            })
        else:
            key_factors.append({
                'factor': 'Credit History',
                'impact': 'Negative',
                'description': 'Credit score does not meet prime guidelines; elevated default risk.'
            })

        if total_income >= 6000:
            key_factors.append({
                'factor': 'Household Income',
                'impact': 'Positive',
                'description': f'Strong combined household earnings (${int(total_income):,}/month).'
            })
        elif total_income < 3000:
            key_factors.append({
                'factor': 'Household Income',
                'impact': 'Negative',
                'description': f'Moderate household earnings (${int(total_income):,}/month) relative to requested loan.'
            })

        if loan_amount <= 150:
            key_factors.append({
                'factor': 'Loan Sizing',
                'impact': 'Positive',
                'description': f'Requested principal (${int(loan_amount)}k) is within healthy underwriting bounds.'
            })
        elif loan_amount > 250:
            key_factors.append({
                'factor': 'Loan Sizing',
                'impact': 'Warning',
                'description': f'Higher-tier principal requested (${int(loan_amount)}k); requires strict collateral verification.'
            })

        if property_area == 'Semiurban':
            key_factors.append({
                'factor': 'Property Area',
                'impact': 'Positive',
                'description': 'Semiurban zones demonstrate statistically highest approval rates in dataset.'
            })

        # Risk Classification
        if prob_approved >= 75:
            risk_level = 'Low'
            risk_badge = 'Prime Quality'
        elif prob_approved >= 50:
            risk_level = 'Moderate'
            risk_badge = 'Acceptable Risk'
        else:
            risk_level = 'High'
            risk_badge = 'Elevated Default Probability'

        return jsonify({
            'success': True,
            'prediction': 'Approved' if is_approved else 'Rejected',
            'loan_status': 'Y' if is_approved else 'N',
            'prob_approved': prob_approved,
            'prob_rejected': prob_rejected,
            'confidence': prob_approved if is_approved else prob_rejected,
            'model_used': 'Random Forest Classifier' if model_type == 'rfc' else 'Logistic Regression',
            'risk_level': risk_level,
            'risk_badge': risk_badge,
            'key_factors': key_factors,
            'input_summary': {
                'ApplicantIncome': applicant_income,
                'CoapplicantIncome': coapplicant_income,
                'TotalIncome': total_income,
                'LoanAmount': loan_amount,
                'LoanTerm': loan_amount_term,
                'CreditHistory': 'Satisfactory (1.0)' if credit_history >= 1 else 'Subprime / Delinquent (0.0)',
                'PropertyArea': property_area,
                'Education': education
            }
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 400

@app.route('/api/retrain', methods=['POST'])
def retrain():
    global model_lr, model_rfc, encoders, metrics, stats
    try:
        train_and_export()
        model_lr, model_rfc, encoders, metrics, stats = load_resources()
        return jsonify({
            'success': True,
            'message': 'Models retrained and refreshed successfully!',
            'metrics': metrics
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5050))
    app.run(host='0.0.0.0', port=port, debug=False)
